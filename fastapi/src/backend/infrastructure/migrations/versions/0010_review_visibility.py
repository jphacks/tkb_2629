"""Keep existing and new reviews private unless explicitly published."""

import sqlalchemy as sa
from alembic import op

revision = "0010_review_visibility"
down_revision = "0009_authentication"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("page_reviews") as batch:
        batch.add_column(
            sa.Column("visibility", sa.String(7), nullable=False, server_default="private")
        )
        batch.create_check_constraint(
            "ck_page_reviews_visibility", "visibility IN ('private', 'public')"
        )


def downgrade() -> None:
    with op.batch_alter_table("page_reviews") as batch:
        batch.drop_constraint("ck_page_reviews_visibility", type_="check")
        batch.drop_column("visibility")
