import sqlalchemy as sa
from alembic import op

revision = "0005_google_books_catalog"
down_revision = "0004_emotion_projection"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("books") as batch_op:
        batch_op.add_column(sa.Column("google_books_id", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("isbn_13", sa.String(length=13), nullable=True))
        batch_op.add_column(sa.Column("thumbnail_url", sa.Text(), nullable=True))
        batch_op.create_unique_constraint("uq_books_google_books_id", ["google_books_id"])
        batch_op.create_unique_constraint("uq_books_isbn_13", ["isbn_13"])


def downgrade() -> None:
    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_constraint("uq_books_isbn_13", type_="unique")
        batch_op.drop_constraint("uq_books_google_books_id", type_="unique")
        batch_op.drop_column("thumbnail_url")
        batch_op.drop_column("isbn_13")
        batch_op.drop_column("google_books_id")
