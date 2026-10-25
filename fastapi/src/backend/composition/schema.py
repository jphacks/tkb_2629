"""Load all owned tables at the composition root; contexts never import sibling models."""

from backend.analysis.infrastructure import models as analysis_models
from backend.identity.infrastructure import models as identity_models
from backend.library.infrastructure import models as library_models
from backend.reviews.infrastructure import models as review_models
from backend.shared.database import Base

__all__ = ["Base", "identity_models", "library_models", "review_models", "analysis_models"]
