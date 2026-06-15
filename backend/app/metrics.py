from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, Info

registry = CollectorRegistry()

app_info = Info("esp_flasher_app", "Application build info", registry=registry)

catalog_products_total = Gauge(
    "esp_flasher_catalog_products_total",
    "Number of products in the catalogue",
    registry=registry,
)
catalog_versions_total = Gauge(
    "esp_flasher_catalog_versions_total",
    "Total number of firmware versions across all products",
    registry=registry,
)

part_downloads_total = Counter(
    "esp_flasher_part_downloads_total",
    "Firmware part download count",
    ["product", "version", "file"],
    registry=registry,
)

http_request_duration_seconds = Histogram(
    "esp_flasher_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path", "status"],
    registry=registry,
)
