export default async function balanceHandler(from, cmd) {
  // In production: call billing/wallet service
  const bal = 256.42;
  return `Your wallet balance is ₹${bal}`;
}
