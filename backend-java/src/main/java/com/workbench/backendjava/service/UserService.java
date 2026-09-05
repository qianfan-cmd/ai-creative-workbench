package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.config.AppProperties;
import com.workbench.backendjava.common.UserRole;
import com.workbench.backendjava.common.UserStatus;
import com.workbench.backendjava.dto.ChangePasswordRequest;
import com.workbench.backendjava.dto.LoginRequest;
import com.workbench.backendjava.dto.ProfileUpdateRequest;
import com.workbench.backendjava.dto.RegisterRequest;
import com.workbench.backendjava.dto.ResetPasswordRequest;
import com.workbench.backendjava.entity.PasswordResetToken;
import com.workbench.backendjava.entity.User;
import com.workbench.backendjava.mapper.PasswordResetTokenMapper;
import com.workbench.backendjava.mapper.UserMapper;
import com.workbench.backendjava.util.JwtUtil;
import com.workbench.backendjava.vo.LoginResponse;
import com.workbench.backendjava.vo.UserVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final long AVATAR_MAX_BYTES = 2 * 1024 * 1024L;
    private static final List<String> AVATAR_EXTENSIONS = List.of("png", "jpg", "jpeg", "webp");
    private static final int PASSWORD_MIN_LENGTH = 6;
    private static final int RESET_TOKEN_HOURS = 1;

    private final UserMapper userMapper;
    private final PasswordResetTokenMapper passwordResetTokenMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;
    private final MailService mailService;
    private final AppProperties appProperties;

    public UserVO register(RegisterRequest request) {
        validatePassword(request.getPassword());

        LambdaQueryWrapper<User> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(User::getUsername, request.getUsername())
                .or()
                .eq(User::getEmail, request.getEmail());

        User exist = userMapper.selectOne(queryWrapper);

        if (exist != null) {
            if (exist.getUsername().equals(request.getUsername())) {
                throw new BusinessException("用户名已存在");
            }
            if (request.getEmail() != null && exist.getEmail().equals(request.getEmail())) {
                throw new BusinessException("邮箱已存在");
            }
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordHash);
        user.setEmail(request.getEmail());
        user.setRole(UserRole.USER);
        user.setStatus(UserStatus.ACTIVE);

        userMapper.insert(user);
        return toUserVO(user);
    }

    public LoginResponse login(LoginRequest request) {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.getUsername())
        );

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("用户名或密码错误");
        }

        if (UserStatus.DISABLED.equals(user.getStatus())) {
            throw new BusinessException("账号已被禁用，请联系管理员");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUser(toUserVO(user));
        return response;
    }

    public UserVO getCurrentUser() {
        User user = requireCurrentUserEntity();
        return toUserVO(user);
    }

    public UserVO updateProfile(ProfileUpdateRequest request) {
        User user = requireCurrentUserEntity();
        assertUsernameAvailable(request.getUsername(), user.getId());
        assertEmailAvailable(request.getEmail(), user.getId());

        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        userMapper.updateById(user);
        return toUserVO(user);
    }

    public UserVO updateAvatar(MultipartFile file) {
        User user = requireCurrentUserEntity();
        validateAvatar(file);

        String subdir = "avatars/" + user.getId();
        String avatarUrl = fileStorageService.store(file, subdir);

        user.setAvatarUrl(avatarUrl);
        userMapper.updateById(user);
        return toUserVO(user);
    }

    public void changePassword(ChangePasswordRequest request) {
        validatePassword(request.getNewPassword());

        User user = requireCurrentUserEntity();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("当前密码不正确");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userMapper.updateById(user);
    }

    public void requestPasswordReset(String email) {
        if (!mailService.isConfigured()) {
            throw new BusinessException(503, "请在 application-local.yml 配置 QQ 邮箱 SMTP（见 application-local.yml.example）");
        }

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getEmail, email)
        );
        if (user == null) {
            return;
        }

        String rawToken = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        String tokenHash = sha256(rawToken);

        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(tokenHash);
        token.setExpiresAt(LocalDateTime.now().plusHours(RESET_TOKEN_HOURS));
        token.setUsed(0);
        token.setCreatedAt(LocalDateTime.now());
        passwordResetTokenMapper.insert(token);

        String resetLink = appProperties.getFrontendBaseUrl().replaceAll("/+$", "")
                + "/reset-password?token=" + rawToken;
        mailService.sendPasswordResetEmail(email, resetLink);
    }

    public void resetPassword(ResetPasswordRequest request) {
        validatePassword(request.getNewPassword());

        String tokenHash = sha256(request.getToken());
        PasswordResetToken token = passwordResetTokenMapper.selectOne(
                new LambdaQueryWrapper<PasswordResetToken>()
                        .eq(PasswordResetToken::getTokenHash, tokenHash)
                        .eq(PasswordResetToken::getUsed, 0)
                        .gt(PasswordResetToken::getExpiresAt, LocalDateTime.now())
        );

        if (token == null) {
            throw new BusinessException("重置链接无效或已过期");
        }

        User user = userMapper.selectById(token.getUserId());
        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userMapper.updateById(user);

        token.setUsed(1);
        passwordResetTokenMapper.updateById(token);
    }

    private User requireCurrentUserEntity() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(401, "用户不存在");
        }
        if (UserStatus.DISABLED.equals(user.getStatus())) {
            throw new BusinessException(401, "账号已被禁用");
        }
        return user;
    }

    private void assertUsernameAvailable(String username, Long excludeUserId) {
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username)
        );
        if (existing != null && !existing.getId().equals(excludeUserId)) {
            throw new BusinessException("用户名已存在");
        }
    }

    private void assertEmailAvailable(String email, Long excludeUserId) {
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getEmail, email)
        );
        if (existing != null && !existing.getId().equals(excludeUserId)) {
            throw new BusinessException("邮箱已存在");
        }
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < PASSWORD_MIN_LENGTH) {
            throw new BusinessException("密码至少 " + PASSWORD_MIN_LENGTH + " 位");
        }
    }

    private void validateAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "文件不能为空");
        }
        if (file.getSize() > AVATAR_MAX_BYTES) {
            throw new BusinessException(400, "头像不能大于 2MB");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.contains(".")) {
            throw new BusinessException(400, "文件名无效");
        }
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!AVATAR_EXTENSIONS.contains(ext)) {
            throw new BusinessException(400, "头像仅支持 PNG、JPG、WebP");
        }
    }

    private UserVO toUserVO(User user) {
        UserVO userVO = new UserVO();
        BeanUtils.copyProperties(user, userVO);
        return userVO;
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException(500, "令牌处理失败");
        }
    }
}
