from telethon import TelegramClient
import os

# Telegram API credentials
API_ID = 
API_HASH = ''

# Путь для сохранения сессии
SESSION_PATH = 'session/telegram_session'

async def create_session():
    try:
        # Создаем клиент
        client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
        
        print("Подключаемся к Telegram...")
        await client.connect()
        
        if not await client.is_user_authorized():
            print("\nНеобходима авторизация.")
            phone = input("Введите номер телефона (в формате +7xxxxxxxxxx): ")
            
            # Отправляем код
            await client.send_code_request(phone)
            code = input("Введите код подтверждения: ")
            
            try:
                await client.sign_in(phone, code)
            except Exception as e:
                print(f"\nОшибка при вводе кода: {e}")
                return
                
        print("\nУспешная авторизация!")
        print(f"Сессия сохранена в: {SESSION_PATH}.session")
        
        # Получаем информацию о текущем пользователе
        me = await client.get_me()
        print(f"\nАвторизован как: {me.first_name} (@{me.username})")
        
        await client.disconnect()
        
    except Exception as e:
        print(f"\nПроизошла ошибка: {e}")

if __name__ == '__main__':
    # Создаем директорию для сессии если её нет
    os.makedirs('session', exist_ok=True)
    
    # Запускаем создание сессии
    import asyncio
    asyncio.run(create_session()) 
