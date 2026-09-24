// Inject time and waiting to test timing/cancellation without real delays.
export async function simulate(
  plan,
  token,
  emit,
  {
    countdown = 3000,
    now = () => performance.now(),
    wait = () => new Promise((resolve) => setTimeout(resolve, 10)),
  } = {},
) {
  if (countdown > 0) emit({ type: 'countdown', seconds: countdown / 1000 });
  const start = now() + countdown;
  let index = 0,
    started = false;
  while (!token.cancelled) {
    const elapsed = now() - start;
    if (elapsed >= 0 && !started) {
      started = true;
      emit({ type: 'playing' });
    }
    while (index < plan.notes.length && elapsed >= plan.notes[index].at) {
      emit({ type: 'note', index: plan.notes[index].index ?? index });
      index++;
    }
    if (elapsed >= plan.duration) break;
    await wait();
  }
  emit({ type: token.cancelled ? 'stopped' : 'done' });
}
