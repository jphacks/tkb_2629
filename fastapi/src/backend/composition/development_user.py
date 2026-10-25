"""Entry point: python -m backend.composition.development_user --email dev@example.com"""

import os
import sys

from backend.identity.application.development import DevelopmentUserProvisioner
from backend.identity.application.errors import IdentityConfigurationError
from backend.identity.infrastructure.security import ArgonPasswords
from backend.identity.infrastructure.unit_of_work import SqlIdentityUnitOfWork
from backend.identity.presentation.development_cli import run
from backend.shared import database


def build_provisioner() -> DevelopmentUserProvisioner:
    enabled = os.getenv("APP_ENV") == "development"
    if not enabled:
        raise IdentityConfigurationError(
            "開発用ユーザー作成はAPP_ENV=developmentでのみ実行できます"
        )
    return DevelopmentUserProvisioner(
        lambda: SqlIdentityUnitOfWork(database.SessionLocal), ArgonPasswords(), enabled=enabled
    )


if __name__ == "__main__":
    sys.exit(run(build_provisioner))
