#include "Cyber/CyberCasinoTable.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Cyber/CyberAvatarCharacter.h"
#include "UObject/ConstructorHelpers.h"

ACyberCasinoTable::ACyberCasinoTable()
{
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	TableMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TableMesh"));
	TableMesh->SetupAttachment(Root);
	TableMesh->SetRelativeScale3D(FVector(2.8f, 1.6f, 0.4f));
	TableMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		TableMesh->SetStaticMesh(CubeMesh.Object);
	}

	InteractionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionBox"));
	InteractionBox->SetupAttachment(Root);
	InteractionBox->SetBoxExtent(FVector(180.0f, 120.0f, 100.0f));
	InteractionBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	InteractionBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	InteractionBox->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	LabelText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("LabelText"));
	LabelText->SetupAttachment(Root);
	LabelText->SetHorizontalAlignment(EHTA_Center);
	LabelText->SetWorldSize(35.0f);
	LabelText->SetRelativeLocation(FVector(0.0f, 0.0f, 110.0f));
	LabelText->SetText(FText::FromString(TEXT("BACCARAT")));
}

FString ACyberCasinoTable::GetInteractLabel() const
{
	return FString::Printf(TEXT("[E] 바카라 시작 (기본 베팅 %d 코인)"), BaseBet);
}

void ACyberCasinoTable::Interact(ACyberAvatarCharacter* Character)
{
	if (!Character)
	{
		return;
	}

	Character->OpenCasino(this);
}

void ACyberCasinoTable::HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex)
{
	if (!Character || OptionIndex < 0 || OptionIndex > 2)
	{
		return;
	}

	if (!Character->SpendCoins(BaseBet))
	{
		Character->PushStatusMessage(TEXT("코인이 부족해 베팅할 수 없습니다."));
		return;
	}

	const int32 PlayerA = DrawCard();
	const int32 PlayerB = DrawCard();
	const int32 BankerA = DrawCard();
	const int32 BankerB = DrawCard();

	const int32 PlayerScore = ScoreHand(PlayerA, PlayerB);
	const int32 BankerScore = ScoreHand(BankerA, BankerB);

	ECyberBetChoice Result = ECyberBetChoice::Tie;
	if (PlayerScore > BankerScore)
	{
		Result = ECyberBetChoice::Player;
	}
	else if (BankerScore > PlayerScore)
	{
		Result = ECyberBetChoice::Banker;
	}

	const ECyberBetChoice Choice = static_cast<ECyberBetChoice>(OptionIndex);
	int32 Payout = 0;
	if (Result == Choice)
	{
		switch (Result)
		{
		case ECyberBetChoice::Player:
			Payout = BaseBet * 2;
			break;
		case ECyberBetChoice::Banker:
			Payout = FMath::FloorToInt(static_cast<float>(BaseBet) * 1.95f);
			break;
		case ECyberBetChoice::Tie:
			Payout = BaseBet * 9;
			break;
		}
		Character->AddCoins(Payout);
	}

	const TCHAR* ResultName = Result == ECyberBetChoice::Player ? TEXT("Player") : (Result == ECyberBetChoice::Banker ? TEXT("Banker") : TEXT("Tie"));
	const int32 Delta = Payout - BaseBet;
	Character->PushStatusMessage(
		FString::Printf(
			TEXT("바카라 결과: P(%d,%d)=%d vs B(%d,%d)=%d -> %s | 수익 %+d"),
			PlayerA,
			PlayerB,
			PlayerScore,
			BankerA,
			BankerB,
			BankerScore,
			ResultName,
			Delta));
}

FString ACyberCasinoTable::BuildMenuText() const
{
	return FString::Printf(TEXT("[바카라] 1:Player  2:Banker  3:Tie  | 베팅 %d 코인  | [E] 닫기"), BaseBet);
}

int32 ACyberCasinoTable::DrawCard() const
{
	const int32 Card = FMath::RandRange(1, 13);
	return Card > 9 ? 0 : Card;
}

int32 ACyberCasinoTable::ScoreHand(int32 A, int32 B) const
{
	return (A + B) % 10;
}
