import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';

const utf8Decoder = new TextDecoder();

let grpcClient: grpc.Client | null = null;
let gateway: Gateway | null = null;

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v != null && v !== '' ? v : fallback;
}

export function assertFabricEnv(): void {
  if (!env('FABRIC_CRYPTO_BASE')) {
    throw new Error(
      'FABRIC_CRYPTO_BASE is not set. Copy backend/.env.example to backend/.env and set the absolute path to test-network/.../peerOrganizations/org1.example.com',
    );
  }
}

async function newGrpcConnection(): Promise<grpc.Client> {
  const cryptoPath = env('FABRIC_CRYPTO_BASE');
  const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  const peerEndpoint = env('PEER_ENDPOINT', 'localhost:7051');
  const peerHostAlias = env('PEER_HOST_ALIAS', 'peer0.org1.example.com');
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
  });
}

/** cryptogen 常见为 `User1@org1.example.com-cert.pem`，部分环境为 `cert.pem` */
async function resolveSignCertPath(cryptoPath: string): Promise<string> {
  const signcertsDir = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');
  let names: string[];
  try {
    names = await fs.readdir(signcertsDir);
  } catch {
    throw new Error(
      `Cannot read ${signcertsDir}. Check FABRIC_CRYPTO_BASE ends with .../org1.example.com, and run ./network.sh up in fabric-samples/test-network so organizations/ is generated.`,
    );
  }
  if (names.includes('cert.pem')) {
    return path.join(signcertsDir, 'cert.pem');
  }
  const pems = names.filter((n) => n.endsWith('.pem'));
  if (pems.length === 0) {
    throw new Error(`No .pem signcert in ${signcertsDir}`);
  }
  const userCert = pems.find((n) => /^User1@org1\.example\.com.*\.pem$/i.test(n));
  return path.join(signcertsDir, userCert ?? pems[0]);
}

async function newIdentity(): Promise<Identity> {
  const cryptoPath = env('FABRIC_CRYPTO_BASE');
  const mspId = env('MSP_ID', 'Org1MSP');
  const certPath = await resolveSignCertPath(cryptoPath);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
  const cryptoPath = env('FABRIC_CRYPTO_BASE');
  const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
  const files = await fs.readdir(keyDirectoryPath);
  const keyPath = path.resolve(keyDirectoryPath, files[0]);
  const privateKeyPem = await fs.readFile(keyPath);
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}

/** 单例 Gateway，进程内复用（勿每请求新建） */
export async function getScoreContract(): Promise<Contract> {
  assertFabricEnv();
  if (!gateway) {
    grpcClient = await newGrpcConnection();
    gateway = connect({
      client: grpcClient,
      identity: await newIdentity(),
      signer: await newSigner(),
      evaluateOptions: () => ({ deadline: Date.now() + 15000 }),
      endorseOptions: () => ({ deadline: Date.now() + 120000 }),
      submitOptions: () => ({ deadline: Date.now() + 120000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
    });
  }
  const channelName = env('CHANNEL_NAME', 'mychannel');
  const chaincodeName = env('CHAINCODE_NAME', 'score');
  return gateway.getNetwork(channelName).getContract(chaincodeName);
}

export function decodeResult(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

export async function closeFabric(): Promise<void> {
  if (gateway) {
    gateway.close();
    gateway = null;
  }
  if (grpcClient) {
    grpcClient.close();
    grpcClient = null;
  }
}
