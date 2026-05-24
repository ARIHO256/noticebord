try:
    import pymysql  # type: ignore

    pymysql.install_as_MySQLdb()
except Exception:
    # PyMySQL is optional; used when MySQL is configured
    pass


