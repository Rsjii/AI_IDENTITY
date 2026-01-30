import { db } from '../../config/database';

export async function savePhoneConnection(userId: string, phoneNumber: string) {
  const existing = await db.query(
    `SELECT id FROM "platform_integrations" WHERE "userId"=$1 AND "platform"='phone' LIMIT 1`,
    [userId]
  );

  if (existing.rows[0]) {
    await db.query(
      `UPDATE "platform_integrations"
       SET "status"='active', "config"=$1, "updatedAt"=now()
       WHERE id=$2`,
      [JSON.stringify({ phoneNumber }), existing.rows[0].id]
    );
    return;
  }

  await db.query(
    `INSERT INTO "platform_integrations" ("id","userId","platform","accessToken","status","config","createdAt","updatedAt")
     VALUES ($1,$2,'phone',NULL,'active',$3,now(),now())`,
    [`phone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, userId, JSON.stringify({ phoneNumber })]
  );
}

export async function getPhoneIntegration(userId: string) {
  const r = await db.query(
    `SELECT * FROM "platform_integrations" WHERE "userId"=$1 AND "platform"='phone' LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function findUserByPhoneNumber(phoneNumber: string) {
  const r = await db.query(
    `SELECT * FROM "platform_integrations"
     WHERE "platform"='phone' AND (config->>'phoneNumber')=$1 AND "status"='active' LIMIT 1`,
    [phoneNumber]
  );
  return r.rows[0] || null;
}

export async function logPhoneCall(params: {
  userId: string;
  callerNumber?: string;
  callSid?: string;
  durationSeconds?: number;
  transcript?: string;
  recordingUrl?: string;
  amountChargedCents?: number;
}) {
  const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.query(
    `INSERT INTO "phone_calls"
     ("id","userId","callerNumber","callSid","durationSeconds","transcript","recordingUrl","amountChargedCents","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [
      id,
      params.userId,
      params.callerNumber || null,
      params.callSid || null,
      params.durationSeconds || null,
      params.transcript || null,
      params.recordingUrl || null,
      params.amountChargedCents || null,
    ]
  );
}

