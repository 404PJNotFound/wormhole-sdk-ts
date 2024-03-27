import { Chain } from "@wormhole-foundation/sdk-base";
import { Signature, createVAA, deserialize, serialize } from "../../index.js";
import { UniversalAddress } from "../../universalAddress.js";
import { keccak256, secp256k1 } from "../../utils.js";

interface Guardian {
  index: number;
  key: string;
}

export class MockGuardians {
  setIndex: number;
  signers: Guardian[];

  constructor(setIndex: number, keys: string[]) {
    this.setIndex = setIndex;
    this.signers = keys.map((key, index): Guardian => {
      return { index, key };
    });
  }

  getPublicKeys() {
    return this.signers.map((guardian) => ethPrivateToPublic(guardian.key));
  }

  addSignatures(message: Uint8Array, guardianIndices: number[]) {
    if (guardianIndices.length == 0) throw Error("guardianIndices.length == 0");

    const signers = this.signers.filter((signer) => guardianIndices.includes(signer.index));

    const vaa = deserialize("Uint8Array", message);

    for (let i = 0; i < signers.length; ++i) {
      const signer = signers.at(i);
      if (!signer) throw Error("No signer with index: " + i);

      const signature = ethSignWithPrivate(signer.key, keccak256(vaa.hash));
      const s = new Signature(signature.r, signature.s, signature.recovery);

      // @ts-ignore -- wants it to be immutable
      vaa.signatures.push({ guardianIndex: i, signature: s });
    }

    return vaa;
  }
}

export class MockEmitter {
  chain: Chain;
  address: UniversalAddress;
  sequence: bigint;

  constructor(emitterAddress: UniversalAddress, chain: Chain, startSequence?: bigint) {
    this.chain = chain;
    this.address = emitterAddress;
    this.sequence = startSequence == undefined ? 0n : startSequence;
  }

  publishMessage(
    nonce: number,
    payload: Uint8Array,
    consistencyLevel: number,
    timestamp?: number,
    uptickSequence: boolean = true,
  ) {
    if (uptickSequence) {
      ++this.sequence;
    }

    return serialize(
      createVAA("Uint8Array", {
        guardianSet: 0,
        signatures: [],
        nonce: nonce,
        timestamp: timestamp ?? 0,
        sequence: this.sequence,
        emitterChain: this.chain,
        emitterAddress: this.address,
        consistencyLevel: consistencyLevel,
        payload: payload,
      }),
    );
  }
}

export function ethPrivateToPublic(privateKey: string) {
  return secp256k1.getPublicKey(privateKey);
}

export function ethSignWithPrivate(privateKey: string, hash: Uint8Array) {
  if (hash.length != 32) throw new Error("hash.length != 32");
  return secp256k1.sign(hash, privateKey);
}

export function ethValidateSig(signature: Signature, publicKey: Uint8Array, hash: Uint8Array) {
  const { r, s } = signature;
  return secp256k1.verify({ r, s }, hash, publicKey);
}
