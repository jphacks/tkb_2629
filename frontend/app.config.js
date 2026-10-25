module.exports = ({ config }) => {
  const baseUrl = process.env.DEMO_BASE_PATH;
  if (baseUrl && process.env.EXPO_PUBLIC_DEMO_MODE !== 'true') {
    throw new Error('DEMO_BASE_PATH requires EXPO_PUBLIC_DEMO_MODE=true');
  }
  if (baseUrl && !/^\/[A-Za-z0-9_-]+$/.test(baseUrl)) {
    throw new Error('DEMO_BASE_PATH must be a single absolute path such as /tkb_2629');
  }
  return {
    ...config,
    ...(baseUrl ? { experiments: { ...config.experiments, baseUrl } } : {}),
  };
};
