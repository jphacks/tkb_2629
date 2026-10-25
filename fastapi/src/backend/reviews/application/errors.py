from __future__ import annotations


class ServiceUnavailable(Exception):
    pass


class ExternalServiceError(Exception):
    pass


class AnalysisUnavailable(Exception):
    pass
