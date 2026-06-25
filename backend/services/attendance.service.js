function submitTimeLogAction(workspace_id, payload) {
  validateTimeLogAction(workspace_id, payload);
  const result = insertTimeLog(workspace_id, payload);
  const state = getCurrentState(
    workspace_id,
    payload.email,
    payload.shift_id
  );

  return {
    success: true,
    message: result.message,
    log_id: result.log_id,
    state
  };
}