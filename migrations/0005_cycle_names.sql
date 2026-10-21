-- 已有库里的演示轮次改成历史样本，不再用周次当产品模型。
UPDATE cycles SET name = '示例·优化前' WHERE id = 'cycle-baseline' AND name = '第 0 周基线';
UPDATE cycles SET name = '示例·优化后' WHERE id = 'cycle-retest' AND name = '第 4 周复测';
