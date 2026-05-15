import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';
import type { AppRole } from './auth';

const utf8Decoder = new TextDecoder();

export type FabricProfile = 'org1' | 'org2';

type CachedGw = { gateway: Gateway; client: grpc.Client };

const gatewayCache = new Map<FabricProfile, CachedGw>();

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v != null && v !== '' ? v : fallback;
}

function deriveOrg2CryptoBase(org1Base: string): string {
  if (env('FABRIC_CRYPTO_BASE_ORG2')) return path.resolve(env('FABRIC_CRYPTO_BASE_ORG2'));
  return org1Base.replace(/org1\.example\.com/g, 'org2.example.com');
}

export function assertFabricEnv(): void {
  if (!env('FABRIC_CRYPTO_BASE')) {
    throw new Error(
      'FABRIC_CRYPTO_BASE is not set. Copy backend/.env.example to backend/.env and set the absolute path to test-network/.../peerOrganizations/org1.example.com',
    );
  }
}

/** 学生 / 用人单位使用 Org2 证书经 Gateway 调用；成绩写入链码仅接受 Org1MSP。 */
export function fabricProfileForRole(role: AppRole): FabricProfile {
  if (role === 'Student' || role === 'ExternalVerifier') return 'org2';
  return 'org1';
}

async function newGrpcConnection(profile: FabricProfile): Promise<grpc.Client> {
  const org1Base = path.resolve(env('FABRIC_CRYPTO_BASE'));
  const cryptoRoot = profile === 'org1' ? org1Base : deriveOrg2CryptoBase(org1Base);

  const peerTlsRel =
    profile === 'org1'
      ? ['peers', 'peer0.org1.example.com', 'tls', 'ca.crt']
      : ['peers', 'peer0.org2.example.com', 'tls', 'ca.crt'];
  const tlsCertPath = path.resolve(cryptoRoot, ...peerTlsRel);
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

  const peerEndpoint =
    profile === 'org1' ? env('PEER_ENDPOINT', 'localhost:7051') : env('PEER_ENDPOINT_ORG2', 'localhost:9051');
  const peerHostAlias =
    profile === 'org1'
      ? env('PEER_HOST_ALIAS', 'peer0.org1.example.com')
      : env('PEER_HOST_ALIAS_ORG2', 'peer0.org2.example.com');

  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
  });
}

async function resolveSignCertPath(cryptoPath: string, profile: FabricProfile): Promise<string> {
  const userDir = profile === 'org1' ? 'User1@org1.example.com' : 'User1@org2.example.com';
  const signcertsDir = path.resolve(cryptoPath, 'users', userDir, 'msp', 'signcerts');
  let names: string[];
  try {
    names = await fs.readdir(signcertsDir);
  } catch {
    throw new Error(
      `Cannot read ${signcertsDir}. For org2, ensure test-network generated org2 artifacts or set FABRIC_CRYPTO_BASE_ORG2.`,
    );
  }
  if (names.includes('cert.pem')) {
    return path.join(signcertsDir, 'cert.pem');
  }
  const pems = names.filter((n) => n.endsWith('.pem'));
  if (pems.length === 0) {
    throw new Error(`No .pem signcert in ${signcertsDir}`);
  }
  const want =
    profile === 'org1' ? /^User1@org1\.example\.com.*\.pem$/i : /^User1@org2\.example\.com.*\.pem$/i;
  const userCert = pems.find((n) => want.test(n));
  return path.join(signcertsDir, userCert ?? pems[0]);
}

async function newIdentity(profile: FabricProfile): Promise<Identity> {
  const org1Base = path.resolve(env('FABRIC_CRYPTO_BASE'));
  const cryptoPath = profile === 'org1' ? org1Base : deriveOrg2CryptoBase(org1Base);
  const mspId = profile === 'org1' ? env('MSP_ID', 'Org1MSP') : env('MSP_ID_ORG2', 'Org2MSP');
  const certPath = await resolveSignCertPath(cryptoPath, profile);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner(profile: FabricProfile): Promise<Signer> {
  const org1Base = path.resolve(env('FABRIC_CRYPTO_BASE'));
  const cryptoPath = profile === 'org1' ? org1Base : deriveOrg2CryptoBase(org1Base);
  const userDir = profile === 'org1' ? 'User1@org1.example.com' : 'User1@org2.example.com';
  const keyDirectoryPath = path.resolve(cryptoPath, 'users', userDir, 'msp', 'keystore');
  const files = await fs.readdir(keyDirectoryPath);
  const keyPath = path.resolve(keyDirectoryPath, files[0]);
  const privateKeyPem = await fs.readFile(keyPath);
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}

async function getOrCreateGateway(profile: FabricProfile): Promise<Gateway> {
  assertFabricEnv();
  let entry = gatewayCache.get(profile);
  if (!entry) {
    const grpcClient = await newGrpcConnection(profile);
    const gateway = connect({
      client: grpcClient,
      identity: await newIdentity(profile),
      signer: await newSigner(profile),
      evaluateOptions: () => ({ deadline: Date.now() + 15000 }),
      endorseOptions: () => ({ deadline: Date.now() + 120000 }),
      submitOptions: () => ({ deadline: Date.now() + 120000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
    });
    entry = { gateway, client: grpcClient };
    gatewayCache.set(profile, entry);
  }
  return entry.gateway;
}

export async function getScoreContract(profile: FabricProfile): Promise<Contract> {
  const gateway = await getOrCreateGateway(profile);
  const channelName = env('CHANNEL_NAME', 'mychannel');
  const chaincodeName = env('CHAINCODE_NAME', 'score');
  return gateway.getNetwork(channelName).getContract(chaincodeName);
}

export async function closeFabric(): Promise<void> {
  for (const { gateway, client } of gatewayCache.values()) {
    gateway.close();
    client.close();
  }
  gatewayCache.clear();
}

export function decodeResult(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

/** 按 Fabric Profile 拉取当前世界状态下成绩 JSON 文本（用于双读一致性比对等） */
export async function evaluateGetScoreJson(
  profile: FabricProfile,
  studentId: string,
  courseId: string,
  semester: string,
): Promise<string> {
  const contract = await getScoreContract(profile);
  const bytes = await contract.evaluateTransaction('GetScore', studentId, courseId, semester);
  return decodeResult(bytes);
}

/** 演示用：返回签名证书 PEM 前几行（不含私钥） */
export async function getSignCertPemPreview(profile: FabricProfile): Promise<{
  mspId: string;
  certPath: string;
  pemPreview: string;
}> {
  const org1Base = path.resolve(env('FABRIC_CRYPTO_BASE'));
  const cryptoPath = profile === 'org1' ? org1Base : deriveOrg2CryptoBase(org1Base);
  const mspId = profile === 'org1' ? env('MSP_ID', 'Org1MSP') : env('MSP_ID_ORG2', 'Org2MSP');
  const certPath = await resolveSignCertPath(cryptoPath, profile);
  const pem = await fs.readFile(certPath, 'utf8');
  const lines = pem.split(/\r?\n/).filter(Boolean).slice(0, 6);
  return {
    mspId,
    certPath,
    pemPreview: `${lines.join('\n')}\n…（已截断；私钥在 keystore，勿导出到浏览器）`,
  };
}
