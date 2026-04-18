import terser from '@rollup/plugin-terser';

const input = 'src/index.js';

const terserOptions = {
  compress: {
    passes: 2,
    drop_console: true,
    pure_getters: true,
  },
  mangle: { toplevel: true },
  format: { comments: false },
};

const banner = `/*! openrtb-identity-resolver v${process.env.npm_package_version} | MIT */`;

export default [
  // ESM — for bundlers (webpack, rollup, vite)
  {
    input,
    output: {
      file:    'dist/index.esm.js',
      format:  'es',
      banner,
      sourcemap: true,
    },
    plugins: [terser(terserOptions)],
  },

  // CJS — for Node.js / Jest
  {
    input,
    output: {
      file:    'dist/index.cjs',
      format:  'cjs',
      exports: 'named',
      banner,
      sourcemap: true,
    },
    plugins: [terser(terserOptions)],
  },

  // UMD — for <script> tag / CDN consumption
  {
    input,
    output: {
      file:    'dist/index.umd.js',
      format:  'umd',
      name:    'OpenRTBIdentityResolver',
      exports: 'named',
      banner,
      sourcemap: true,
    },
    plugins: [terser(terserOptions)],
  },
];
