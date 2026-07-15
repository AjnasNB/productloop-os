import { DuplicateSkillError, ManifestValidationError, SignatureVerificationError } from "./errors.js";
import { sanitizeJson } from "./stable-json.js";
import { computeSkillDigest, verifySkillSignature } from "./signature.js";
import type { JsonObject, RegisterSkillOptions, RegistryRecord, SignedSkillManifest, SkillManifest, SkillRegistryOptions } from "./types.js";
import { validateSkillManifest } from "./validation.js";

export class SkillRegistry {
  private readonly records = new Map<string, RegistryRecord>();
  private readonly audit?: SkillRegistryOptions["audit"];
  private readonly keyResolver?: SkillRegistryOptions["keyResolver"];
  private readonly clock: () => Date;

  constructor(options: SkillRegistryOptions = {}) {
    this.audit = options.audit;
    this.keyResolver = options.keyResolver;
    this.clock = options.clock ?? (() => new Date());
  }

  register(input: SkillManifest | SignedSkillManifest, options: RegisterSkillOptions): RegistryRecord {
    const signed = isSignedManifest(input) ? input : undefined;
    const manifest = signed?.manifest ?? input as SkillManifest;
    const validation = validateSkillManifest(manifest);
    if (!validation.valid) {
      throw new ManifestValidationError(validation.issues);
    }

    if (signed) {
      const key = this.keyResolver?.(signed.signature.keyId) ?? null;
      if (!key || !verifySkillSignature(signed, key)) {
        throw new SignatureVerificationError(signed.signature.keyId);
      }
    }

    const digest = computeSkillDigest(manifest);
    const recordKey = `${manifest.id}@${manifest.version}`;
    const existing = this.records.get(recordKey);
    if (existing) {
      if (existing.digest !== digest) {
        throw new DuplicateSkillError(manifest.id, manifest.version);
      }
      return cloneRecord(existing);
    }

    const record: RegistryRecord = {
      manifest: sanitizeJson(manifest) as unknown as SkillManifest,
      ...(signed === undefined ? {} : { signed: sanitizeJson(signed) as unknown as SignedSkillManifest }),
      digest,
      registeredAt: this.clock().toISOString(),
      registeredBy: options.actor,
      source: options.source
    };
    this.records.set(recordKey, cloneRecord(record));
    this.audit?.record({
      type: "skill.registered",
      actor: options.actor,
      skillId: manifest.id,
      version: manifest.version,
      digest,
      data: sanitizeJson({
        source: options.source,
        publisher: manifest.trust.publisher,
        trustSource: manifest.trust.source,
        signatureKeyId: signed?.signature.keyId ?? null
      }) as JsonObject
    });
    return cloneRecord(record);
  }

  get(skillId: string, version?: string): RegistryRecord | null {
    if (version) {
      const record = this.records.get(`${skillId}@${version}`);
      return record ? cloneRecord(record) : null;
    }
    const matches = [...this.records.values()].filter((record) => record.manifest.id === skillId);
    const record = matches.sort((left, right) => right.manifest.version.localeCompare(left.manifest.version, undefined, { numeric: true })).at(0);
    return record ? cloneRecord(record) : null;
  }

  list(): RegistryRecord[] {
    return [...this.records.values()]
      .sort((left, right) => `${left.manifest.id}@${left.manifest.version}`.localeCompare(`${right.manifest.id}@${right.manifest.version}`))
      .map(cloneRecord);
  }
}

function cloneRecord(record: RegistryRecord): RegistryRecord {
  return sanitizeJson(record) as unknown as RegistryRecord;
}

function isSignedManifest(value: SkillManifest | SignedSkillManifest): value is SignedSkillManifest {
  return typeof value === "object" && value !== null && "manifest" in value && "signature" in value && "digest" in value;
}
