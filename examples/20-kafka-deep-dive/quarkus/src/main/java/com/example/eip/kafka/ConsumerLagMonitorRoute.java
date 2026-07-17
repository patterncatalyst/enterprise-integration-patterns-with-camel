package com.example.eip.kafka;

import java.util.Map;
import java.util.Properties;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsResult;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;

@ApplicationScoped
public class ConsumerLagMonitorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:lag-monitor?period=30000&delay=10000")
            .routeId("consumer-lag-monitor")
            .process(exchange -> {
                String brokers = exchange.getContext()
                    .resolvePropertyPlaceholders("{{kafka.brokers}}");
                String groupId = "transactional-pipeline";

                Properties props = new Properties();
                props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, brokers);
                props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000");
                props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000");

                try (AdminClient admin = AdminClient.create(props)) {
                    ListConsumerGroupOffsetsResult result =
                        admin.listConsumerGroupOffsets(groupId);
                    Map<TopicPartition, OffsetAndMetadata> offsets =
                        result.partitionsToOffsetAndMetadata().get();

                    StringBuilder report = new StringBuilder();
                    report.append("Consumer group '").append(groupId).append("' offsets:\n");

                    for (Map.Entry<TopicPartition, OffsetAndMetadata> entry : offsets.entrySet()) {
                        TopicPartition tp = entry.getKey();
                        OffsetAndMetadata meta = entry.getValue();
                        report.append(String.format("  %s [partition %d] -> committed offset %d%n",
                            tp.topic(), tp.partition(), meta.offset()));
                    }

                    if (offsets.isEmpty()) {
                        report.append("  No committed offsets found (group may be inactive)");
                    }

                    exchange.getIn().setBody(report.toString());
                } catch (Exception e) {
                    exchange.getIn().setBody(
                        "Lag monitor: unable to query group '" + groupId + "': " + e.getMessage());
                }
            })
            .log("${body}");
    }
}
