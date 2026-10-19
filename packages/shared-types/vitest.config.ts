import { defineConfig, mergeConfig } from 'vitest/config';

import base from '@lifespire/config/vitest';

export default mergeConfig(base, defineConfig({ test: { name: 'shared-types' } }));
