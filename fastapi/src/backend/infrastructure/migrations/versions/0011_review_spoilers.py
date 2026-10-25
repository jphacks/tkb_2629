"""Default existing and new reviews to containing spoilers."""

import sqlalchemy as sa
from alembic import op

revision = "0011_review_spoilers"
down_revision = "0010_review_visibility"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "page_reviews",
        sa.Column("contains_spoilers", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    with op.batch_alter_table("page_reviews") as batch:
        batch.drop_column("contains_spoilers")
