export type ConnectReadinessState = {
  operationalStatus: string | null;
  payoutScheduleInterval: string | null;
  payoutStatus: string | null;
  payoutsEnabled: boolean;
  transfersStatus: string | null;
};

export type ConnectReadinessDecision = {
  kind: "blocked" | "isolated" | "ready";
  reason:
    | "blocking_financial_history"
    | "no_financial_history"
    | "ready"
    | "snapshot_mismatch";
};

export function evaluateConnectReadiness(input: {
  hasPositiveFinancialHistory: boolean;
  local: ConnectReadinessState;
  remote: ConnectReadinessState;
}): ConnectReadinessDecision {
  if (!statesMatch(input.local, input.remote)) {
    return { kind: "blocked", reason: "snapshot_mismatch" };
  }

  if (isReady(input.remote)) {
    return { kind: "ready", reason: "ready" };
  }

  if (input.hasPositiveFinancialHistory) {
    return { kind: "blocked", reason: "blocking_financial_history" };
  }

  return { kind: "isolated", reason: "no_financial_history" };
}

export function isReady(state: ConnectReadinessState) {
  return state.operationalStatus === "ready" &&
    state.transfersStatus === "active" &&
    state.payoutsEnabled === true &&
    state.payoutStatus === "enabled" &&
    state.payoutScheduleInterval === "daily";
}

function statesMatch(
  local: ConnectReadinessState,
  remote: ConnectReadinessState,
) {
  return local.operationalStatus === remote.operationalStatus &&
    local.transfersStatus === remote.transfersStatus &&
    local.payoutsEnabled === remote.payoutsEnabled &&
    local.payoutStatus === remote.payoutStatus &&
    local.payoutScheduleInterval === remote.payoutScheduleInterval;
}
