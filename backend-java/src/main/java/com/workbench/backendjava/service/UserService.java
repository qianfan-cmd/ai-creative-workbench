package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.dto.LoginRequest;
import com.workbench.backendjava.dto.RegisterRequest;
import com.workbench.backendjava.entity.User;
import com.workbench.backendjava.mapper.UserMapper;
import com.workbench.backendjava.util.JwtUtil;
import com.workbench.backendjava.vo.LoginResponse;
import com.workbench.backendjava.vo.UserVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;

    /**
     * 注册逻辑
     * 账号密码-》检验是否存在-》检验是否合法-》加密密码-》入库-》返回VO
     */
    private final PasswordEncoder passwordEncoder;

    public UserVO register(RegisterRequest request) {

        LambdaQueryWrapper<User> queryWrapper = new LambdaQueryWrapper<>();
        // 检查用户名和邮箱
        queryWrapper.eq(User::getUsername, request.getUsername())
                    .or()
                    .eq(User::getEmail, request.getEmail());

        User exist = userMapper.selectOne(queryWrapper);

        if (exist != null) {
            if (exist.getUsername().equals(request.getUsername())) {
                throw new BusinessException("用户名已存在");
            }
            if (exist.getEmail().equals(request.getEmail())) {
                throw new BusinessException("邮箱已存在");
            }
        }

        // TODO 检查密码是否合法

        // 加密密码
        /**
         * encode(明文密码)
         * hash 类似: $2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
         */
        String passwordHash = passwordEncoder.encode(request.getPassword());

        // 组装用户对象
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordHash);
        user.setEmail(request.getEmail());
        user.setRole("USER");

        // 入库
        userMapper.insert(user);

        // 转VO
        UserVO userVO = new UserVO();
        BeanUtils.copyProperties(user, userVO);
        return userVO;

    }

    /**
     * 登录逻辑
     * LoginRequest->查用户是否存在/密码是否正确->生成token->返回LoginResponse
     */
    public LoginResponse login(LoginRequest request) {
        // 查用户
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.getUsername())
        );

        // 用户不存在或密码输入错误->统一提示
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("用户名或密码错误");
        }

        // 生成token
        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        // 组装返回
        UserVO userVO = new UserVO();
        BeanUtils.copyProperties(user, userVO);

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUser(userVO);
        return response;
    }
}
