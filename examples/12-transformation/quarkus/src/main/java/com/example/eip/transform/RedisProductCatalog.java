package com.example.eip.transform;

import java.util.Map;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.hash.HashCommands;
import io.quarkus.runtime.Startup;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
@Startup
public class RedisProductCatalog {

    private final HashCommands<String, String, String> hash;

    @Inject
    public RedisProductCatalog(RedisDataSource ds) {
        this.hash = ds.hash(String.class, String.class, String.class);
        seedCatalog();
    }

    private void seedCatalog() {
        addProduct("SKU-ABC-42", "Wireless Headphones", "29.99", "Electronics", "0.3", "ZONE-1");
        addProduct("SKU-DEF-77", "Running Shoes", "89.99", "Footwear", "1.2", "ZONE-2");
        addProduct("SKU-GHI-13", "Coffee Maker", "149.99", "Appliances", "4.5", "ZONE-3");
        addProduct("SKU-US-1", "USB-C Cable", "12.99", "Electronics", "0.1", "ZONE-1");
        addProduct("SKU-CA-2", "Maple Syrup", "18.50", "Food", "0.8", "ZONE-2");
        addProduct("SKU-GB-3", "Tea Set", "45.00", "Kitchen", "2.0", "ZONE-3");
    }

    private void addProduct(String sku, String name, String price, String category, String weight, String zone) {
        String key = "product:" + sku;
        hash.hset(key, Map.of(
            "name", name,
            "price", price,
            "category", category,
            "weight_kg", weight,
            "shipping_zone", zone
        ));
    }

    public Map<String, String> lookup(String sku) {
        Map<String, String> product = hash.hgetall("product:" + sku);
        if (product == null || product.isEmpty()) {
            return Map.of(
                "name", "Unknown Product",
                "category", "General",
                "weight_kg", "1.0",
                "shipping_zone", "ZONE-1"
            );
        }
        return product;
    }
}
