#include "Cyber/CyberShopTerminal.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Cyber/CyberAvatarCharacter.h"
#include "UObject/ConstructorHelpers.h"

ACyberShopTerminal::ACyberShopTerminal()
{
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	TerminalMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TerminalMesh"));
	TerminalMesh->SetupAttachment(Root);
	TerminalMesh->SetRelativeScale3D(FVector(0.8f, 0.8f, 2.2f));
	TerminalMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		TerminalMesh->SetStaticMesh(CubeMesh.Object);
	}

	InteractionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionBox"));
	InteractionBox->SetupAttachment(Root);
	InteractionBox->SetBoxExtent(FVector(80.0f, 80.0f, 160.0f));
	InteractionBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	InteractionBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	InteractionBox->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	LabelText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("LabelText"));
	LabelText->SetupAttachment(Root);
	LabelText->SetHorizontalAlignment(EHTA_Center);
	LabelText->SetWorldSize(35.0f);
	LabelText->SetRelativeLocation(FVector(0.0f, 0.0f, 180.0f));
	LabelText->SetText(FText::FromString(TEXT("NEON SHOP")));

	ShopItems = {
		{FName(TEXT("NeonBlade")), TEXT("네온 블레이드"), 180},
		{FName(TEXT("HoloJacket")), TEXT("홀로 자켓"), 140},
		{FName(TEXT("DronePet")), TEXT("드론 펫"), 260},
	};
}

FString ACyberShopTerminal::GetInteractLabel() const
{
	return TEXT("[E] 상점 열기");
}

void ACyberShopTerminal::Interact(ACyberAvatarCharacter* Character)
{
	if (!Character)
	{
		return;
	}

	Character->OpenShop(this);
}

void ACyberShopTerminal::HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex)
{
	if (!Character || !ShopItems.IsValidIndex(OptionIndex))
	{
		return;
	}

	const FCyberShopItem& Item = ShopItems[OptionIndex];
	if (!Character->SpendCoins(Item.Price))
	{
		Character->PushStatusMessage(FString::Printf(TEXT("코인이 부족합니다. 필요: %d"), Item.Price));
		return;
	}

	Character->AddInventoryItem(Item.ItemId, 1);
	Character->PushStatusMessage(FString::Printf(TEXT("구매 완료: %s (-%d 코인)"), *Item.DisplayName, Item.Price));
}

FString ACyberShopTerminal::BuildMenuText() const
{
	FString Menu = TEXT("[상점] 번호로 구매 1/2/3, [E] 닫기\n");
	for (int32 Index = 0; Index < ShopItems.Num(); ++Index)
	{
		const FCyberShopItem& Item = ShopItems[Index];
		Menu += FString::Printf(TEXT("%d) %s - %d 코인\n"), Index + 1, *Item.DisplayName, Item.Price);
	}
	return Menu;
}
