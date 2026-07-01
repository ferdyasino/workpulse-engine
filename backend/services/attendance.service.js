function submitTimeLogAction(workspace_id, payload) {
  try {
    const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

    if (!normalizedWorkspaceId) {
      throw new Error("workspace_id is required");
    }

    if (!payload) {
      throw new Error("payload is required");
    }

    if (payload.shift_id && payload.action !== "time_in" && !payload.date) {
      const logs = getTimeLogsByEmail(normalizedWorkspaceId, payload.email, {
        shift_id: payload.shift_id,
      });

      const state = buildTimeLogState(logs);

      if (state.is_clocked_in && logs.length) {
        payload.date = logs[logs.length - 1].date;
      }
    }

    const normalized = normalizeTimeLog(payload, normalizedWorkspaceId);

    validateTimeLogAction(normalizedWorkspaceId, normalized);

    const result = insertTimeLog(normalizedWorkspaceId, normalized);

    if (!result || result.success === false) {
      throw new Error(result && result.message ? result.message : "Failed to save timelog action.");
    }

    const state = getCurrentState(normalizedWorkspaceId, normalized.email, normalized.shift_id);

    return {
      success: true,
      message: sanitizeTimeLogActionSuccessMessage(normalized.action, result.message),
      log_id: result.log_id || "",
      state,
    };
  } catch (err) {
    return {
      success: false,
      message: sanitizeRuleError(err),
    };
  }
}
