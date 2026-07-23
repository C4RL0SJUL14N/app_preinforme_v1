import { clearCache } from './cache.js';
import { supabaseRequest } from './supabase.js';

const TABLE_NAME = 'password_reset_tokens';

export async function getLatestPasswordResetForTeacher(teacherId) {
  const rows = await supabaseRequest(TABLE_NAME, {
    query: {
      select: 'created_at',
      teacher_id: `eq.${teacherId}`,
      order: 'created_at.desc',
      limit: '1'
    }
  });
  return rows?.[0] || null;
}

export async function createPasswordResetRecord({ tokenHash, teacherId, expiresAt }) {
  await supabaseRequest(TABLE_NAME, {
    method: 'PATCH',
    query: {
      teacher_id: `eq.${teacherId}`,
      used_at: 'is.null'
    },
    body: { used_at: new Date().toISOString() }
  });

  await supabaseRequest(TABLE_NAME, {
    method: 'POST',
    body: {
      token_hash: tokenHash,
      teacher_id: teacherId,
      expires_at: expiresAt
    },
    prefer: 'return=minimal'
  });
}

export async function deletePasswordResetRecord(tokenHash) {
  await supabaseRequest(TABLE_NAME, {
    method: 'DELETE',
    query: { token_hash: `eq.${tokenHash}` }
  });
}

export async function resetTeacherPasswordWithToken(tokenHash, passwordHash) {
  const teacherId = await supabaseRequest('rpc/reset_teacher_password', {
    method: 'POST',
    body: {
      p_token_hash: tokenHash,
      p_password_hash: passwordHash
    }
  });
  if (teacherId) clearCache('sheet:Teachers');
  return teacherId || '';
}
