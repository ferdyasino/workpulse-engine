/**
 * =====================================================
 * WORKSPACE PROVISIONER (FIXED + SAFE)
 * =====================================================
 */

/**
 * Main provisioning entry point
 * Accepts email OR ownerId safely
 */
function provisionWorkspace(identifier) {
  try {

    if (!identifier) {
      throw new Error("identifier is required");
    }

    // Normalize input
    const normalized = typeof normalizeEmail === "function"
      ? normalizeEmail(identifier)
      : String(identifier).trim().toLowerCase();

    const result = createWorkspace(normalized);

    return {
      success: true,
      ...result
    };

  } catch (error) {
    console.error(
      `❌ Provisioning failed for ${identifier}:`,
      error.toString()
    );

    throw error;
  }
}


/**
 * Batch provisioning (safe + consistent output)
 */
function provisionMultipleWorkspaces(identifierList = []) {
  if (!Array.isArray(identifierList) || identifierList.length === 0) {
    throw new Error("identifierList must be a non-empty array");
  }

  const results = [];

  for (const id of identifierList) {
    try {

      const result = provisionWorkspace(id);

      results.push({
        identifier: id,
        success: true,
        alreadyExists: !!result.alreadyExists,
        workspaceId: result.workspace?.workspaceId || null,
        result
      });

    } catch (error) {

      results.push({
        identifier: id,
        success: false,
        error: error.message
      });

    }
  }

  return results;
}


/**
 * Full provisioning with safe post-seed hook
 */
function fullProvisionWorkspace(identifier) {

  const result = provisionWorkspace(identifier);

  const isNew =
    result.success &&
    !result.alreadyExists;

  if (isNew) {

    console.info(
      `📌 Triggering post-provision hooks for: ${identifier}`
    );

    // SAFE HOOK AREA (future-proof)
    // seedWorkspace already runs inside createWorkspace,
    // so do NOT duplicate unless explicitly needed.

  }

  return result;
}