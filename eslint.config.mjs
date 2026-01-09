// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import {globalIgnores} from "@eslint/config-helpers";

export default defineConfig(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    globalIgnores(['api', 'dist', 'webpack.config.js']),
);
