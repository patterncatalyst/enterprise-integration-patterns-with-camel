package com.example.eip.loanbroker;

import com.example.eip.loanbroker.model.BankQuote;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class BankRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Bank A — Universal Lender: base rate 5.5%, approves most applications
        from("direct:quote-bank-a")
            .routeId("bank-a-quote")
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                String requestId = (String) body.get("requestId");
                int creditScore = ((Number) body.get("creditScore")).intValue();
                double amount = ((Number) body.get("amount")).doubleValue();
                int termMonths = ((Number) body.get("termMonths")).intValue();

                double baseRate = 5.5;
                // Adjust rate based on credit score
                double rate = baseRate - (creditScore - 600) * 0.005;
                rate = Math.max(rate, 4.0);
                boolean approved = creditScore >= 580;
                double monthlyPayment = approved ? calculateMonthly(amount, rate, termMonths) : 0;

                var quote = new BankQuote(requestId, "bank-a", "Universal Lender",
                    Math.round(rate * 100.0) / 100.0, Math.round(monthlyPayment * 100.0) / 100.0, approved);
                exchange.getIn().setBody(quote);
            })
            .log("Bank A quote for ${body.requestId}: rate=${body.interestRate}%, approved=${body.approved}")
            .marshal().json()
            .to("kafka:loan.bank.reply?brokers={{kafka.brokers}}");

        // Bank B — Community Credit Union: base rate 4.8%, moderate standards
        from("direct:quote-bank-b")
            .routeId("bank-b-quote")
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                String requestId = (String) body.get("requestId");
                int creditScore = ((Number) body.get("creditScore")).intValue();
                double amount = ((Number) body.get("amount")).doubleValue();
                int termMonths = ((Number) body.get("termMonths")).intValue();

                double baseRate = 4.8;
                double rate = baseRate - (creditScore - 650) * 0.006;
                rate = Math.max(rate, 3.5);
                boolean approved = creditScore >= 650 && amount <= 500_000;
                double monthlyPayment = approved ? calculateMonthly(amount, rate, termMonths) : 0;

                var quote = new BankQuote(requestId, "bank-b", "Community Credit Union",
                    Math.round(rate * 100.0) / 100.0, Math.round(monthlyPayment * 100.0) / 100.0, approved);
                exchange.getIn().setBody(quote);
            })
            .log("Bank B quote for ${body.requestId}: rate=${body.interestRate}%, approved=${body.approved}")
            .marshal().json()
            .to("kafka:loan.bank.reply?brokers={{kafka.brokers}}");

        // Bank C — Prime National: base rate 3.9%, premium borrowers only
        from("direct:quote-bank-c")
            .routeId("bank-c-quote")
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                String requestId = (String) body.get("requestId");
                int creditScore = ((Number) body.get("creditScore")).intValue();
                double amount = ((Number) body.get("amount")).doubleValue();
                int termMonths = ((Number) body.get("termMonths")).intValue();

                double baseRate = 3.9;
                double rate = baseRate - (creditScore - 720) * 0.008;
                rate = Math.max(rate, 2.9);
                boolean approved = creditScore >= 720;
                double monthlyPayment = approved ? calculateMonthly(amount, rate, termMonths) : 0;

                var quote = new BankQuote(requestId, "bank-c", "Prime National",
                    Math.round(rate * 100.0) / 100.0, Math.round(monthlyPayment * 100.0) / 100.0, approved);
                exchange.getIn().setBody(quote);
            })
            .log("Bank C quote for ${body.requestId}: rate=${body.interestRate}%, approved=${body.approved}")
            .marshal().json()
            .to("kafka:loan.bank.reply?brokers={{kafka.brokers}}");
    }

    private static double calculateMonthly(double principal, double annualRate, int termMonths) {
        double monthlyRate = annualRate / 100.0 / 12.0;
        if (monthlyRate == 0) {
            return principal / termMonths;
        }
        return principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)
            / (Math.pow(1 + monthlyRate, termMonths) - 1);
    }
}
