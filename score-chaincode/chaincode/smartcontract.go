package chaincode

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	statusActive   = "ACTIVE"
	statusRevoked  = "REVOKED"
)

// SmartContract 成绩存证（生命周期 + 历史 + 验真）
type SmartContract struct {
	contractapi.Contract
}

// ScoreRecord 链上成绩记录（单键 SCORE_学号_课程_学期，历史版本靠 GetHistoryForKey）
type ScoreRecord struct {
	StudentID string `json:"studentId"`
	CourseID  string `json:"courseId"`
	Semester  string `json:"semester"`
	Score     int    `json:"score"`
	Status    string `json:"status"`    // ACTIVE | REVOKED
	UpdatedAt int64  `json:"updatedAt"` // 交易时间（秒），便于报表
	Operator  string `json:"operator"`  // 调用者 MSP ID
	Remark    string `json:"remark"`    // 更正/作废说明
}

// ScoreHistoryItem 单条键历史（用于溯源）
type ScoreHistoryItem struct {
	TxId          string        `json:"txId"`
	TimestampUnix int64         `json:"timestampUnix"`
	IsDelete      bool          `json:"isDelete"`
	Record        *ScoreRecord  `json:"record,omitempty"`
}

// VerifyResult 验真结果
type VerifyResult struct {
	Match   bool   `json:"match"`
	Reason  string `json:"reason"`
	Current int    `json:"current,omitempty"`
	Status  string `json:"status,omitempty"`
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

// PutScore 写入或覆盖一条成绩（兼容旧 CLI：Args 后四位为学号、课程、学期、分数）
func (s *SmartContract) PutScore(ctx contractapi.TransactionContextInterface, studentID, courseID, semester, scoreStr string) error {
	if err := assertOrg1Mutate(ctx); err != nil {
		return err
	}
	score, err := strconv.Atoi(scoreStr)
	if err != nil {
		return fmt.Errorf("invalid score: %w", err)
	}
	key := makeKey(studentID, courseID, semester)
	rec := ScoreRecord{
		StudentID: studentID,
		CourseID:  courseID,
		Semester:  semester,
		Score:     score,
		Status:    statusActive,
		UpdatedAt: txUnixSeconds(ctx),
		Operator:  operatorMSP(ctx),
		Remark:    "",
	}
	return putScoreRecord(ctx, key, &rec)
}

// CorrectScore 更正分数（逻辑上仍为同一条业务记录；链下可通过 GetScoreHistory 看版本）
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
	cur.Status = statusActive
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

// VerifyScore 将「声称分数」与链上当前记录比对（作废记录不匹配）
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
