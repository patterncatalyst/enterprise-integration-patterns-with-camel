package com.example.eip.k8sdeploy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class KubernetesDeployApplication {

    public static void main(String[] args) {
        SpringApplication.run(KubernetesDeployApplication.class, args);
    }
}
