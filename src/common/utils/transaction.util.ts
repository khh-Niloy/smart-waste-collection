import { ClientSession, Connection } from 'mongoose';

function isReplicaSetUnsupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('transaction numbers are only allowed on a replica set') ||
    msg.includes('replica set') ||
    msg.includes('sessions are not supported')
  );
}

/**
 * Executes database work inside a MongoDB replica-set transaction when supported.
 * On standalone MongoDB instances (where transactions are unavailable), falls
 * back to running without a session and invokes `onRollback` if an error occurs.
 */
export async function runWithOptionalTransaction<T>(
  connection: Connection,
  work: (session: ClientSession | null) => Promise<T>,
  onRollback?: () => Promise<void>,
): Promise<T> {
  let session: ClientSession | null = null;
  try {
    session = await connection.startSession();
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session && session.inTransaction()) {
      await session.abortTransaction().catch(() => undefined);
    }

    if (isReplicaSetUnsupportedError(error)) {
      try {
        return await work(null);
      } catch (fallbackError) {
        if (onRollback) {
          await onRollback().catch(() => undefined);
        }
        throw fallbackError;
      }
    }

    throw error;
  } finally {
    if (session) {
      await session.endSession().catch(() => undefined);
    }
  }
}
