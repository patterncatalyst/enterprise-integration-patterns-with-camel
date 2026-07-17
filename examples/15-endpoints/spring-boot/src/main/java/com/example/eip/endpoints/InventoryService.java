package com.example.eip.endpoints;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class InventoryService {

    private static final Logger LOG = LoggerFactory.getLogger(InventoryService.class);

    public Map<String, Object> checkStock(Map<String, Object> order) {
        String itemSku = (String) order.get("item_sku");
        Object orderId = order.get("order_id");

        LOG.info("Checking stock for SKU {} (order {})", itemSku, orderId);

        // Simulate inventory lookup — odd SKU hash means in stock
        boolean inStock = itemSku != null && (itemSku.hashCode() & 1) == 1;
        int available = inStock ? 50 : 0;

        var result = new LinkedHashMap<String, Object>(order);
        result.put("in_stock", inStock);
        result.put("available_quantity", available);
        result.put("inventory_checked_at", System.currentTimeMillis());

        LOG.info("SKU {} — in_stock={}, available={}", itemSku, inStock, available);
        return result;
    }
}
