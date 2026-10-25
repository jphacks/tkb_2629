"""Keep public display names unset until explicitly chosen."""

import sqlalchemy as sa
from alembic import op

revision = "0012_public_display_name"
down_revision = "0011_review_spoilers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("public_display_name", sa.String(100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("public_display_name")
