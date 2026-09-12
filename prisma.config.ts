import { defineConfig } from 'prisma/config';

try {
    require('dotenv').config();
} catch {}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
