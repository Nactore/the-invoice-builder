import os
from enum import Enum

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

"""
    1. Use .env as default env file
    2. Add variable in Settings class if needed in all envs
"""

# Load the default .env file
load_dotenv(".env", override=True, verbose=True)

# Determine the environment
environment = os.getenv("ENVIRONMENT", "development")


# Define a Settings class inheriting from BaseSettings
class Settings(BaseSettings):
    # Default values for settings
    DATABASE_URL: str = os.getenv("DATABASE_URL")


# Define subclass for development environment settings
class DevelopmentSettings(Settings):
    DEBUG: bool = True  # Override debug mode to True for development environment

# Define subclass for production environment settings
class ProductionSettings(Settings):
    DEBUG: bool = False  # Override debug mode to False for production environment


# Create instances of each settings class for different environments
development_settings = DevelopmentSettings()  # Settings for development environment
production_settings = ProductionSettings()  # Settings for production environment

# Define class for the Settings Enum
class SettingsEnum(Enum):
    development = development_settings
    production = production_settings

settings = getattr(SettingsEnum, environment).value
