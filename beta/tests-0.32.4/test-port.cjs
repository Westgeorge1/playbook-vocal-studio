module.exports = (usual, offset) => {
  if (!process.env.PVS_PORT_BASE) return usual;
  const base=Number(process.env.PVS_PORT_BASE);
  if (!Number.isInteger(base) || base<1024 || base>65520) throw Error('PVS_PORT_BASE must be 1024–65520');
  return base+offset;
};
