const tickSeconds = Number(process.env.APK_BUILDER_TICK_SECONDS || 45);

function tick() {
  const now = new Date().toISOString();
  console.log(`[apk-builder] heartbeat at=${now} queue=0 status=idle`);
}

console.log(`[apk-builder] started (interval=${tickSeconds}s)`);
void tick();

setInterval(() => {
  void tick();
}, tickSeconds * 1000);
