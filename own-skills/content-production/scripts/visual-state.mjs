export const visualComponentNames = ['body_visual', 'wechat_cover'];

export function initialVisualComponent() {
  return { status: 'pending', attempt: 0, artifacts: [], error: null };
}

export function resetVisualAggregate(visual, invalidatedBy, now) {
  const resetComponent = (component) => ({
    ...initialVisualComponent(),
    attempt: component?.attempt || 0,
    invalidated_by: invalidatedBy,
    updated_at: now
  });
  return {
    status: 'pending',
    revision: visual?.revision || 0,
    artifacts: [],
    error: null,
    body_visual: resetComponent(visual?.body_visual),
    wechat_cover: resetComponent(visual?.wechat_cover),
    invalidated_by: invalidatedBy,
    updated_at: now
  };
}

export function bodyVisualAttempt(state) {
  return componentAttempt(state, 'body_visual');
}

export function wechatCoverAttempt(state) {
  return componentAttempt(state, 'wechat_cover');
}

export function componentAttempt(state, component) {
  const nested = state?.stages?.visual?.[component]?.attempt;
  if (Number.isInteger(nested) && nested > 0) return nested;
  const legacy = state?.stages?.visual?.attempt;
  return Number.isInteger(legacy) && legacy > 0 ? legacy : 1;
}

export function visualVersion(attempt) {
  const version = `v${String(attempt).padStart(3, '0')}`;
  return {
    attempt,
    version,
    suffix: attempt === 1 ? '' : `.${version}`,
    directory: attempt === 1 ? '' : `${version}/`
  };
}

export function deriveVisualStatus(visual) {
  const components = visualComponentNames.map((name) => visual?.[name]);
  if (components.every((component) => component?.status === 'completed')) return 'completed';
  if (components.some((component) => ['pending', 'running'].includes(component?.status))) {
    return components.some((component) => component?.status === 'running') ? 'running' : 'pending';
  }
  return 'blocked';
}

export function aggregateVisualArtifacts(visual) {
  return visualComponentNames.flatMap((name) => visual?.[name]?.artifacts || []);
}
