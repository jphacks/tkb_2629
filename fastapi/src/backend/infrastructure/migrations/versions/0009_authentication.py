"""Authentication and authorization context; legacy users get no credentials."""

import sqlalchemy as sa
from alembic import op

revision = "0009_authentication"
down_revision = "0008_emotion_percentages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_credentials",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("auth_credentials.user_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("family_id", sa.String(64), nullable=False, index=True),
        sa.Column("refresh_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires", sa.BigInteger(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "auth_challenges",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("auth_credentials.user_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("expires", sa.BigInteger(), nullable=False),
    )
    op.create_table(
        "auth_rate_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires", sa.BigInteger(), nullable=False, index=True),
    )


def downgrade() -> None:
    for table in ("auth_rate_limits", "auth_challenges", "auth_sessions", "auth_credentials"):
        op.drop_table(table)
