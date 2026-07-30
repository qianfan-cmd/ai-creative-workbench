package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class LoginResponse {

    /**
     * JWT token
     */
    private String token;
    private UserVO user;
}
