-- Supabase 分析数据表（单次执行）
-- 单表单行，存储全站访问/交互计数

CREATE TABLE IF NOT EXISTS public.analytics (
    id INT PRIMARY KEY DEFAULT 1,
    total INT NOT NULL DEFAULT 0,
    today INT NOT NULL DEFAULT 0,
    wechat INT NOT NULL DEFAULT 0,
    copy INT NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    CONSTRAINT single_row CHECK (id = 1)
);

-- 禁用 RLS：仅后端 service_role 访问
ALTER TABLE public.analytics DISABLE ROW LEVEL SECURITY;

-- 初始化第一行数据（从本地 analytics-data.json 迁移而来）
INSERT INTO public.analytics (id, total, today, wechat, copy, date, updated_at)
VALUES (1, 5, 5, 3, 2, '2026-10-26', '2026-10-26T23:26:20+08:00')
ON CONFLICT (id) DO NOTHING;
