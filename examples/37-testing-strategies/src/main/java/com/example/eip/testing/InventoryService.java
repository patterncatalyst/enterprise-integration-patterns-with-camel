package com.example.eip.testing;

import java.util.HashMap;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

@ApplicationScoped
@Named("inventoryService")
public class InventoryService {

    public Map<String, Object> checkStock(Map<String, Object> order) {
        Map<String, Object> enriched = new HashMap<>(order);
        String sku = (String) order.getOrDefault("item_sku", "UNKNOWN");

        enriched.put("warehouse", "WAREHOUSE-EAST");
        enriched.put("stock_available", sku.startsWith("ELEC") ? 42 : 150);
        enriched.put("weight_kg", 2.5);

        return enriched;
    }
}
