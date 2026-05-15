package chaincode

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	statusPending = "PENDING"
	statusActive  = "ACTIVE"
	statusRevoked = "REVOKED"
)

const appealObjectType = "APPEAL"

// SmartContract 成绩存证（生命周期 + 历史 + 验真 + 待审核 + 申诉）
type SmartContract struct {
	contractapi.Contract
}

// ScoreRecord 链上成绩记录（单键 SCORE_学号_课程_学期，历史版本靠 GetHistoryForKey）
type ScoreRecord struct {
	StudentID string `json:"studentId"`
	CourseID  string `json:"courseId"`
	Semester  string `json:"semester"`
	Score     int    `json:"score"`
	Status    string `json:"status"`    // PENDING | ACTIVE | REVOKED
	UpdatedAt int64  `json:"updatedAt"` // 交易时间（秒），便于报表
	Operator  string `json:"operator"`  // 调用者 MSP ID
	Remark    string `json:"remark"`    // 更正/作废说明
}

// ScoreHistoryItem 单条键历史（用于溯源）
type ScoreHistoryItem struct {
	TxId          string       `json:"txId"`
	TimestampUnix int64        `json:"timestampUnix"`
	IsDelete      bool         `json:"isDelete"`
	Record        *ScoreRecord `json:"record,omitempty"`
}

// VerifyResult 验真结果
type VerifyResult struct {
	Match   bool   `json:"match"`
	Reason  string `json:"reason"`
	Current int    `json:"current,omitempty"`
	Status  string `json:"status,omitempty"`
}

// AppealRecord 学生申诉（独立复合键，便于按学号列举）
type AppealRecord struct {
	StudentID  string `json:"studentId"`
	CourseID   string `json:"courseId"`
	Semester   string `json:"semester"`
	Reason     string `json:"reason"`
	Status     string `json:"status"` // OPEN | RESOLVED
	Resolution string `json:"resolution,omitempty"`
	CreatedAt  int64  `json:"createdAt"`
	ResolvedAt int64  `json:"resolvedAt,omitempty"`
}

func makeKey(studentID, courseID, semester string) string {
	return fmt.Sprintf("SCORE_%s_%s_%s", studentID, courseID, semester)
}

func operatorMSP(ctx contractapi.TransactionContextInterface) string {
	msp, err := cid.GetMSPID(ctx.GetStub())
	if err != nil || msp == "" {
		return "UNKNOWN"
	}
	return msp
}

// assertOrg1Mutate ABAC：敏感写操作仅 Org1MSP；若证书含 Fabric CA 登记的 abac.role=student|verifier 亦拒绝（双保险）
func assertOrg1Mutate(ctx contractapi.TransactionContextInterface) error {
	msp, err := cid.GetMSPID(ctx.GetStub())
	if err != nil {
		return fmt.Errorf("ABAC: 读取 MSP 失败: %w", err)
	}
	if msp != "Org1MSP" {
		return fmt.Errorf("ABAC: 成绩写入仅允许 Org1MSP 背书，当前 MSP=%s（学生/用人单位使用 Org2 Gateway 时链码在此拒绝）", msp)
	}
	if role, found, err := cid.GetAttributeValue(ctx.GetStub(), "abac.role"); err != nil {
		return err
	} else if found && (role == "student" || role == "verifier") {
		return fmt.Errorf("ABAC: 身份属性 abac.role=%s 禁止写入成绩", role)
	}
	return nil
}

func assertOrg2StudentAppeal(ctx contractapi.TransactionContextInterface) error {
	msp, err := cid.GetMSPID(ctx.GetStub())
	if err != nil {
		return fmt.Errorf("ABAC: 读取 MSP 失败: %w", err)
	}
	if msp != "Org2MSP" {
		return fmt.Errorf("ABAC: 申诉仅允许 Org2MSP 提交，当前 MSP=%s", msp)
	}
	return nil
}

func txUnixSeconds(ctx contractapi.TransactionContextInterface) int64 {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil || ts == nil {
		return 0
	}
	return ts.GetSeconds()
}

func normalize(rec *ScoreRecord) {
	if rec.Status == "" {
		rec.Status = statusActive
	}
}

func readScore(ctx contractapi.TransactionContextInterface, key string) (*ScoreRecord, error) {
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, err
	}
	if b == nil {
		return nil, nil
	}
	var rec ScoreRecord
	if err := json.Unmarshal(b, &rec); err != nil {
		return nil, err
	}
	normalize(&rec)
	return &rec, nil
}

func putScoreRecord(ctx contractapi.TransactionContextInterface, key string, rec *ScoreRecord) error {
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, b)
}

// actor: "" / "DEAN" → 直接生效 ACTIVE；"TEACHER" → 待教务处审核 PENDING（应用层须对应 JWT 角色传参）
func pickInitialStatus(actor string) (string, error) {
	switch actor {
	case "", "DEAN":
		return statusActive, nil
	case "TEACHER":
		return statusPending, nil
	default:
		return "", fmt.Errorf("invalid actor %q: use TEACHER or DEAN", actor)
	}
}

// PutScore 写入成绩：Args 为学号、课程、学期、分数、actor（""|DEAN→ACTIVE，TEACHER→PENDING）。CLI/旧脚本须显式传第六参 DEAN 以保持与旧行为一致。
func (s *SmartContract) PutScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, scoreStr, actor string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	score, err := strconv.Atoi(scoreStr)
	if err != nil {
		return fmt.Errorf("invalid score: %w", err)
	}
	act := actor
	st, err := pickInitialStatus(act)
	if err != nil {
		return err
	}
	key := makeKey(studentID, courseID, semester)
	rec := ScoreRecord{
		StudentID: studentID,
		CourseID:  courseID,
		Semester:  semester,
		Score:     score,
		Status:    st,
		UpdatedAt: txUnixSeconds(ctx),
		Operator:  operatorMSP(ctx),
		Remark:    "",
	}
	return putScoreRecord(ctx, key, &rec)
}

// ApproveScore 教务处审核：PENDING → ACTIVE
func (s *SmartContract) ApproveScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	key := makeKey(studentID, courseID, semester)
	cur, err := readScore(ctx, key)
	if err != nil {
		return err
	}
	if cur == nil {
		return fmt.Errorf("score not found for key %s", key)
	}
	if cur.Status != statusPending {
		return fmt.Errorf("only PENDING scores can be approved, current status=%s", cur.Status)
	}
	cur.Status = statusActive
	cur.UpdatedAt = txUnixSeconds(ctx)
	cur.Operator = operatorMSP(ctx)
	if cur.Remark == "" {
		cur.Remark = "教务处审核通过"
	} else {
		cur.Remark = cur.Remark + "；教务处审核通过"
	}
	return putScoreRecord(ctx, key, cur)
}

// CorrectScore 更正分数（PENDING / ACTIVE 均可；REVOKED 不可）
func (s *SmartContract) CorrectScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, newScoreStr, remark string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	score, err := strconv.Atoi(newScoreStr)
	if err != nil {
		return fmt.Errorf("invalid score: %w", err)
	}
	key := makeKey(studentID, courseID, semester)
	cur, err := readScore(ctx, key)
	if err != nil {
		return err
	}
	if cur == nil {
		return fmt.Errorf("score not found for key %s", key)
	}
	if cur.Status == statusRevoked {
		return fmt.Errorf("cannot correct revoked score for key %s", key)
	}
	cur.Score = score
	cur.UpdatedAt = txUnixSeconds(ctx)
	cur.Operator = operatorMSP(ctx)
	cur.Remark = remark
	return putScoreRecord(ctx, key, cur)
}

// RevokeScore 作废（不删键；世界状态仍保留一条 REVOKED 记录，历史可查）
func (s *SmartContract) RevokeScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, remark string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	key := makeKey(studentID, courseID, semester)
	cur, err := readScore(ctx, key)
	if err != nil {
		return err
	}
	if cur == nil {
		return fmt.Errorf("score not found for key %s", key)
	}
	if cur.Status == statusRevoked {
		return fmt.Errorf("score already revoked for key %s", key)
	}
	cur.Status = statusRevoked
	cur.UpdatedAt = txUnixSeconds(ctx)
	cur.Operator = operatorMSP(ctx)
	cur.Remark = remark
	return putScoreRecord(ctx, key, cur)
}

// GetScore 按学号+课程+学期查询当前世界状态
func (s *SmartContract) GetScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester string) (*ScoreRecord, error) {
	key := makeKey(studentID, courseID, semester)
	rec, err := readScore(ctx, key)
	if err != nil {
		return nil, err
	}
	if rec == nil {
		return nil, fmt.Errorf("score not found for key %s", key)
	}
	return rec, nil
}

// GetScoreHistory 返回该键的版本链（新 → 旧顺序由迭代器决定，通常最新在前）
func (s *SmartContract) GetScoreHistory(ctx contractapi.TransactionContextInterface, studentID, courseID, semester string) ([]ScoreHistoryItem, error) {
	key := makeKey(studentID, courseID, semester)
	iter, err := ctx.GetStub().GetHistoryForKey(key)
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []ScoreHistoryItem
	for iter.HasNext() {
		mod, err := iter.Next()
		if err != nil {
			return nil, err
		}
		item := ScoreHistoryItem{
			TxId:          mod.GetTxId(),
			TimestampUnix: 0,
			IsDelete:      mod.GetIsDelete(),
		}
		if ts := mod.GetTimestamp(); ts != nil {
			item.TimestampUnix = ts.GetSeconds()
		}
		if len(mod.GetValue()) > 0 {
			var rec ScoreRecord
			if err := json.Unmarshal(mod.GetValue(), &rec); err != nil {
				return nil, err
			}
			normalize(&rec)
			item.Record = &rec
		}
		out = append(out, item)
	}
	return out, nil
}

// VerifyScore 将「声称分数」与链上当前记录比对（作废 / 待审核单独说明）
func (s *SmartContract) VerifyScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, claimedScoreStr string) (*VerifyResult, error) {
	claimed, err := strconv.Atoi(claimedScoreStr)
	if err != nil {
		return nil, fmt.Errorf("invalid claimed score: %w", err)
	}
	key := makeKey(studentID, courseID, semester)
	rec, err := readScore(ctx, key)
	if err != nil {
		return nil, err
	}
	if rec == nil {
		return &VerifyResult{Match: false, Reason: "no record on ledger"}, nil
	}
	if rec.Status == statusRevoked {
		return &VerifyResult{Match: false, Reason: "record is revoked", Current: rec.Score, Status: rec.Status}, nil
	}
	if rec.Status == statusPending {
		if rec.Score == claimed {
			return &VerifyResult{
				Match:   true,
				Reason:  "score matches but record pending approval (not formally published)",
				Current: rec.Score,
				Status:  rec.Status,
			}, nil
		}
		return &VerifyResult{
			Match:   false,
			Reason:  "score mismatch (record pending approval)",
			Current: rec.Score,
			Status:  rec.Status,
		}, nil
	}
	if rec.Score != claimed {
		return &VerifyResult{
			Match:   false,
			Reason:  "score mismatch",
			Current: rec.Score,
			Status:  rec.Status,
		}, nil
	}
	return &VerifyResult{Match: true, Reason: "ok", Current: rec.Score, Status: rec.Status}, nil
}

// SubmitAppeal 学生发起申诉（Org2MSP）
func (s *SmartContract) SubmitAppeal(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, reason string) error {
	if err := assertOrg2StudentAppeal(ctx); err != nil {
		return err
	}
	if reason == "" {
		return fmt.Errorf("reason is required")
	}
	txID := ctx.GetStub().GetTxID()
	ck, err := ctx.GetStub().CreateCompositeKey(appealObjectType, []string{studentID, courseID, semester, txID})
	if err != nil {
		return err
	}
	rec := AppealRecord{
		StudentID: studentID,
		CourseID:  courseID,
		Semester:  semester,
		Reason:    reason,
		Status:    "OPEN",
		CreatedAt: txUnixSeconds(ctx),
	}
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(ck, b)
}

// ResolveAppeal 教务/教师处理申诉（Org1MSP）；compositeKey 为列表接口返回的 compositeKey
func (s *SmartContract) ResolveAppeal(ctx contractapi.TransactionContextInterface, compositeKey, resolution string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	if resolution == "" {
		return fmt.Errorf("resolution is required")
	}
	b, err := ctx.GetStub().GetState(compositeKey)
	if err != nil {
		return err
	}
	if b == nil {
		return fmt.Errorf("appeal not found")
	}
	var rec AppealRecord
	if err := json.Unmarshal(b, &rec); err != nil {
		return err
	}
	if rec.Status != "OPEN" {
		return fmt.Errorf("appeal already resolved")
	}
	rec.Status = "RESOLVED"
	rec.Resolution = resolution
	rec.ResolvedAt = txUnixSeconds(ctx)
	out, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(compositeKey, out)
}

// AppealListItem 列表项
type AppealListItem struct {
	CompositeKey string       `json:"compositeKey"`
	Appeal       AppealRecord `json:"appeal"`
}

// ListOpenAppeals 列出待处理申诉（Org1 查询）
func (s *SmartContract) ListOpenAppeals(ctx contractapi.TransactionContextInterface) ([]AppealListItem, error) {
	iter, err := ctx.GetStub().GetStateByPartialCompositeKey(appealObjectType, []string{})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []AppealListItem
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var rec AppealRecord
		if err := json.Unmarshal(kv.GetValue(), &rec); err != nil {
			return nil, err
		}
		if rec.Status != "OPEN" {
			continue
		}
		out = append(out, AppealListItem{
			CompositeKey: kv.GetKey(),
			Appeal:       rec,
		})
	}
	return out, nil
}

// ListMyAppeals 学生查看本人申诉（Org2；按学号前缀）
func (s *SmartContract) ListMyAppeals(ctx contractapi.TransactionContextInterface, studentID string) ([]AppealListItem, error) {
	if err := assertOrg2StudentAppeal(ctx); err != nil {
		return nil, err
	}
	iter, err := ctx.GetStub().GetStateByPartialCompositeKey(appealObjectType, []string{studentID})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var out []AppealListItem
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var rec AppealRecord
		if err := json.Unmarshal(kv.GetValue(), &rec); err != nil {
			return nil, err
		}
		out = append(out, AppealListItem{
			CompositeKey: kv.GetKey(),
			Appeal:       rec,
		})
	}
	return out, nil
}
