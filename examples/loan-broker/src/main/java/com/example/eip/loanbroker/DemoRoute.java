package com.example.eip.loanbroker;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:demo-loans?period=8000&delay=5000")
            .routeId("demo-loan-generator")
            .process(exchange -> {
                long counter = exchange.getIn().getHeader("CamelTimerCounter", Long.class);

                // Vary credit scores from 580 to 800
                int[] scores = {580, 620, 650, 680, 700, 720, 750, 780, 800};
                int creditScore = scores[(int) (counter % scores.length)];

                // Vary amounts from 50k to 500k
                double amount = 50_000 + (counter * 47_000 % 450_000);

                // Vary terms: 12, 24, 36, 60, 120, 180, 240, 360
                int[] terms = {12, 24, 36, 60, 120, 180, 240, 360};
                int termMonths = terms[(int) (counter % terms.length)];

                String customerId = "CUST-%03d".formatted(counter % 100);

                String json = """
                    {
                        "customerId": "%s",
                        "amount": %.2f,
                        "termMonths": %d,
                        "creditScore": %d
                    }
                    """.formatted(customerId, amount, termMonths, creditScore);

                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", customerId);
            })
            .to("kafka:loan.requests?brokers={{kafka.brokers}}")
            .log("Demo loan request generated: score=${body}");
    }
}
