from ipware import get_client_ip as _ipware_get_client_ip


def get_client_ip(request) -> str | None:
    ip, _ = _ipware_get_client_ip(request)
    return ip or None
