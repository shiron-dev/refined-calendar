import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import CopyPlugin from "copy-webpack-plugin";

const dirName = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(dirName, "src");

export default {
  ...(process.env.BUILD_ENV !== "development" ? {} : { devtool: "inline-source-map" }),
  entry: {
    content_scripts_main: path.join(srcDir, "content_scripts/main.tsx"),
    backgrounds_background: path.join(srcDir, "backgrounds/background.ts"),
    // feature_favorite: path.join(srcDir, 'feature/*'),
  },
  output: {
    path: path.join(dirName, "./extensions"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.webpack.json",
            transpileOnly: true,
          },
        },
        exclude: [/node_modules/, /src\/pages/],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@": srcDir,
      "react": path.resolve(dirName, "node_modules/react"),
      "react-dom": path.resolve(dirName, "node_modules/react-dom"),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: ".", to: ".", context: "public" },
        // { from: 'configs', to: '.' }
      ],
      options: {},
    }),
  ],
  mode: process.env.BUILD_ENV === "development" ? "development" : "production",
};
