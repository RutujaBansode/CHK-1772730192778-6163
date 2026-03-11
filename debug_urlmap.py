from app import app

print(app.url_map)
for rule in app.url_map.iter_rules():
    print(rule, rule.methods)
