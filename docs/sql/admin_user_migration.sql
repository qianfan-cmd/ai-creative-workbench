-- 用户状态 + 管理员角色种子

ALTER TABLE user ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' AFTER role;

-- 将首个测试账号设为管理员（按需修改 username）
UPDATE user SET role = 'ADMIN' WHERE username = 'testuser' LIMIT 1;
