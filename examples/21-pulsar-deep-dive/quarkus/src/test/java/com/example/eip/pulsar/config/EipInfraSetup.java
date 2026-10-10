package com.example.eip.pulsar.config;

import org.citrusframework.annotations.CitrusConfiguration;
import org.citrusframework.api.container.AfterSuite;
import org.citrusframework.api.container.BeforeSuite;
import org.citrusframework.dsl.TestActionSupport;
import org.citrusframework.spi.BindToRegistry;

import static org.citrusframework.container.SequenceAfterSuite.Builder.afterSuite;
import static org.citrusframework.container.SequenceBeforeSuite.Builder.beforeSuite;

@CitrusConfiguration
public class EipInfraSetup implements TestActionSupport {

    @BindToRegistry
    public BeforeSuite startInfra() {
        return beforeSuite().actions(
                    testcontainers().compose()
                            .up("_infra/compose.yaml")
                            .containerName("eip-pulsar-deep-dive-infra")
                            .autoRemove(false),
                    waitFor()
                            .http()
                            .url("http://localhost:8080/admin/v2/brokers/health")
                            .seconds(90),
                    // Pulsar 5 standalone reports healthy before it has created
                    // public/default; a test that starts in between fails with
                    // "Namespace not found". Wait for the namespace itself.
                    waitFor()
                            .http()
                            .url("http://localhost:8080/admin/v2/namespaces/public/default")
                            .seconds(90)
                ).build();
    }

    @BindToRegistry
    public AfterSuite stopInfra() {
        return afterSuite().actions(
                    camel().camelContext().stop(),
                    testcontainers().compose()
                            .down()
                            .containerName("eip-pulsar-deep-dive-infra")
                ).build();
    }
}
